"""Bound blocking provider work without releasing capacity on waiter cancellation."""

import asyncio
from collections import defaultdict
from weakref import WeakKeyDictionary
from .request_context import operation_context


class BlockingIO:
    def __init__(self, limit=8, per_principal=2):
        self.capacity = asyncio.Semaphore(limit)
        self.per_principal = per_principal
        self.principals = {}
        self.users = defaultdict(int)

    async def run(self, function, *args, principal="", **kwargs):
        gate = self.principals.setdefault(principal, asyncio.Semaphore(self.per_principal))
        self.users[principal] += 1
        try:
            await gate.acquire()
            try:
                await self.capacity.acquire()
            except BaseException:
                gate.release()
                raise
        except BaseException:
            self._forget(principal)
            raise
        task = asyncio.create_task(asyncio.to_thread(function, *args, **kwargs))
        def complete(job):
            self.capacity.release()
            gate.release()
            self._forget(principal)
            if not job.cancelled():
                job.exception()  # consume failures after a caller has cancelled
        task.add_done_callback(complete)
        return await asyncio.shield(task)

    def _forget(self, principal):
        self.users[principal] -= 1
        if self.users[principal] == 0:
            del self.users[principal]
            self.principals.pop(principal, None)


_pools = WeakKeyDictionary()


async def run_blocking(function, *args, principal="", **kwargs):
    loop = asyncio.get_running_loop()
    if loop not in _pools:
        _pools[loop] = BlockingIO()
    return await _pools[loop].run(function, *args, principal=principal or operation_context.get().principal_id, **kwargs)
