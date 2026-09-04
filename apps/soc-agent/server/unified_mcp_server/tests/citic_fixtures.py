"""Small valid CITIC SPL fixture shared by detection service tests."""


def citic_spl(
    logic: str = "index=main error",
    *,
    rulename: str = "0724",
    gid: str = "50176",
    source: str = '"QiAnXin EDR"',
    hostname: str = "client_name",
) -> str:
    return f'''{logic}
| eval GID="{gid}"
| eval rulename="{rulename}"
| eval search=strftime(now(), "%Y%m%d%H%M")
| eval Fix_Ticketnumber=GID."".search."".rulename
| eval Fix_TriggerTime=strftime(now(), "%F %T")
| eval "Fix_Index"="G{gid}"
| eval "Fix_Source Type"={source}
| eval "Event_Hostname"={hostname}
| eval "Event_Date Time"=strftime(_time, "%F %T")
| table Fix_Ticketnumber, Fix_TriggerTime, Fix_Index, "Fix_Source Type", Event_Hostname, "Event_Date Time"
| outputcsv [
    | stats count
    | addinfo
    | eval rulename="{rulename}"
    | eval search=strftime(now(), "%Y%m%d%H%M")
    | eval casename="{gid}"."".search."".rulename
    | return $casename
]'''


__all__ = ["citic_spl"]
