INSERT INTO staff (
    staff_id,
    name,
    username,
    email,
    role,
    status,
    customer_access_uuid
)
VALUES (
    'S00001',
    'SOC Administrator',
    'soc_admin',
    'soc_admin@example.local',
    'admin',
    'active',
    '{}'::UUID[]
)
ON CONFLICT (staff_id) DO NOTHING;
