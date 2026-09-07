INSERT INTO source_types (
    name,
    category,
    vendor,
    product,
    description,
    field_mapping,
    status
)
VALUES
    (
        'Windows Event Log',
        'endpoint',
        'Microsoft',
        'Windows',
        'Windows operating system event logs.',
        '{}'::JSONB,
        'active'
    ),
    (
        'Firewall',
        'firewall',
        NULL,
        NULL,
        'Network firewall events.',
        '{}'::JSONB,
        'active'
    ),
    (
        'Linux',
        'endpoint',
        NULL,
        'Linux',
        'Linux operating system and audit logs.',
        '{}'::JSONB,
        'active'
    ),
    (
        'EDR',
        'endpoint',
        NULL,
        NULL,
        'Endpoint detection and response events.',
        '{}'::JSONB,
        'active'
    ),
    (
        'Email Security',
        'email',
        NULL,
        NULL,
        'Email security and message protection events.',
        '{}'::JSONB,
        'active'
    ),
    (
        'DNS',
        'dns',
        NULL,
        NULL,
        'Domain name system events.',
        '{}'::JSONB,
        'active'
    ),
    (
        'Proxy',
        'proxy',
        NULL,
        NULL,
        'Web proxy events.',
        '{}'::JSONB,
        'active'
    ),
    (
        'VPN',
        'vpn',
        NULL,
        NULL,
        'Virtual private network events.',
        '{}'::JSONB,
        'active'
    )
ON CONFLICT (name) DO NOTHING;
