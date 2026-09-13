import type { SocAdminRootProps } from '../contract.ts'
import css from './AdminUnavailable.module.css'

/** Safe admin-route fallback when the optional admin feature is disabled. */
export function AdminUnavailable({ renderSlot, connection, socClient }: SocAdminRootProps) {
  return (
    <main className={css.root}>
      {renderSlot('soc.admin.content', { connection, socClient }, {
        fallback: (
          <section className={css.card} aria-labelledby="soc-admin-disabled-title">
            <p className={css.kicker}>CITICTEL-CPC · SOC AGENT</p>
            <h1 id="soc-admin-disabled-title">Administration UI is disabled</h1>
            <p>Enable the SOC administration plugin in the application configuration to manage service settings.</p>
            <a className={css.link} href="/">Back to workspace</a>
          </section>
        ),
      })}
    </main>
  )
}
