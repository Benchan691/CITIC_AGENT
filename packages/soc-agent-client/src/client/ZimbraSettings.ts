import React from 'react'
import css from './SplunkZimbraOverlay.module.css'

/** Compatibility export for extensions that still import this settings card. */
export function ZimbraSettings() {
  return React.createElement(
    'section',
    { className: css.section },
    React.createElement('h3', null, 'Zimbra identity'),
    React.createElement(
      'p',
      { className: css.description },
      'Zimbra access uses the signed-in user. Credentials and saved mailbox accounts are not stored by SOC Agent.',
    ),
  )
}
