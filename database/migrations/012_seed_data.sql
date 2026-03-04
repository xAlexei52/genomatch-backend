-- ============================================================
-- MIGRATION 012: Seed data (blood groups, antigens, admin user)
-- Handles pre-existing blood_group_systems with different schema
-- ============================================================

-- Recreate blood_group_systems with correct schema
DROP TABLE IF EXISTS blood_group_systems CASCADE;
CREATE TABLE blood_group_systems (
    id              SMALLINT PRIMARY KEY,
    symbol          VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    gene_names      TEXT[] NOT NULL,
    isbt_number     CHAR(3) NOT NULL UNIQUE
);

-- Blood group systems (ISBT standard)
INSERT INTO blood_group_systems (id, symbol, name, gene_names, isbt_number) VALUES
(1, 'ABO', 'ABO', '{ABO}', '001'),
(2, 'MNS', 'MNS', '{GYPA,GYPB,GYPE}', '002'),
(3, 'P1PK', 'P1PK', '{A4GALT}', '003'),
(4, 'RH', 'Rh', '{RHD,RHCE}', '004'),
(5, 'LU', 'Lutheran', '{BCAM}', '005'),
(6, 'KEL', 'Kell', '{KEL}', '006'),
(7, 'LE', 'Lewis', '{FUT3}', '007'),
(8, 'FY', 'Duffy', '{ACKR1}', '008'),
(9, 'JK', 'Kidd', '{SLC14A1}', '009'),
(10, 'DI', 'Diego', '{SLC4A1}', '010'),
(11, 'YT', 'Yt', '{ACHE}', '011'),
(12, 'XG', 'Xg', '{XG,CD99}', '012'),
(13, 'SC', 'Scianna', '{ERMAP}', '013'),
(14, 'DO', 'Dombrock', '{ART4}', '014'),
(15, 'CO', 'Colton', '{AQP1}', '015'),
(16, 'LW', 'Landsteiner-Wiener', '{ICAM4}', '016'),
(17, 'CH/RG', 'Chido/Rodgers', '{C4A,C4B}', '017'),
(18, 'H', 'H', '{FUT1}', '018'),
(19, 'XK', 'Kx', '{XK}', '019'),
(20, 'GE', 'Gerbich', '{GYPC}', '020'),
(21, 'CROM', 'Cromer', '{CD55}', '021'),
(22, 'KN', 'Knops', '{CR1}', '022'),
(23, 'IN', 'Indian', '{CD44}', '023'),
(24, 'OK', 'Ok', '{BSG}', '024'),
(25, 'RAPH', 'Raph', '{CD151}', '025'),
(26, 'JMH', 'JMH', '{SEMA7A}', '026'),
(27, 'I', 'I', '{GCNT2}', '027'),
(28, 'GLOB', 'GLOB', '{B3GALNT1}', '028'),
(29, 'GIL', 'Gill', '{AQP3}', '029'),
(30, 'RHAG', 'RHAG', '{RHAG}', '030'),
(31, 'FORS', 'FORS', '{GBGT1}', '031'),
(32, 'JR', 'Jr', '{ABCG2}', '032'),
(33, 'LAN', 'Lan', '{ABCB6}', '033'),
(34, 'VEL', 'Vel', '{SMIM1}', '034'),
(35, 'CD59P', 'CD59', '{CD59}', '035'),
(36, 'AUG', 'Augustine', '{SLC29A1}', '036'),
(37, 'KANNO', 'KANNO', '{PRNP}', '037'),
(38, 'SID', 'Sid', '{B4GALNT2}', '038'),
(39, 'CTL2', 'CTL2', '{SLC44A2}', '039'),
(40, 'PEL', 'PEL', '{ABCC4}', '040'),
(41, 'MAM', 'MAM', '{EMP3}', '041'),
(42, 'EMM', 'EMM', '{PIGG}', '042'),
(43, 'ABCC1', 'ABCC1', '{ABCC1}', '043'),
(44, 'ER', 'Er', '{PIEZO1}', '044'),
(45, 'LEWIS2', 'Lewis II', '{FUT2}', '045')
ON CONFLICT (id) DO NOTHING;

-- Antigen catalog (core antigens — first 116 positions)
INSERT INTO cat_antigenos (posicion_vector, nombre_antigeno, sistema_isbt, grupo_antigeno, peso_clinico) VALUES
(0, 'M', 'MNS', 'MN', 0.60),
(1, 'N', 'MNS', 'MN', 0.60),
(2, 'S', 'MNS', 'MNSs', 0.80),
(3, 's', 'MNS', 'MNSs', 0.80),
(4, 'U', 'MNS', 'MNSs', 0.90),
(5, 'Mg', 'MNS', 'MN', 0.30),
(6, 'Mc', 'MNS', 'MN', 0.30),
(7, 'MNTD', 'MNS', 'MN', 0.20),
(8, 'Vw', 'MNS', 'GypAvar', 0.30),
(9, 'Mta', 'MNS', 'GypAvar', 0.20),
(10, 'Sta', 'MNS', 'GypAvar', 0.20),
(11, 'Ria', 'MNS', 'GypAvar', 0.20),
(12, 'Nya', 'MNS', 'GypAvar', 0.20),
(13, 'Hut', 'MNS', 'GypAvar', 0.20),
(14, 'Or', 'MNS', 'GypAvar', 0.20),
(15, 'ENEV', 'MNS', 'GypAvar', 0.20),
(16, 'ENDA', 'MNS', 'GypAvar', 0.20),
(17, 'ENKT', 'MNS', 'GypAvar', 0.20),
(18, 'Mia', 'MNS', 'Miltenberger', 0.40),
(19, 'Vr', 'MNS', 'GypAvar', 0.20),
(20, 'ERIK', 'MNS', 'GypAvar', 0.20),
(21, 'Osa', 'MNS', 'GypAvar', 0.20),
(22, 'HAG', 'MNS', 'GypAvar', 0.20),
(23, 'MARS', 'MNS', 'GypAvar', 0.20),
(24, 'SARA', 'MNS', 'GypAvar', 0.20),
(25, 'DANE', 'MNS', 'GypAvar', 0.20),
(26, 'Hop', 'MNS', 'GypAvar', 0.20),
(27, 'Nob', 'MNS', 'GypAvar', 0.20),
(28, 'RhD', 'RH', 'RhD', 1.00),
(29, 'C', 'RH', 'RhCE', 0.95),
(30, 'c', 'RH', 'RhCE', 0.95),
(31, 'E', 'RH', 'RhCE', 0.95),
(32, 'e', 'RH', 'RhCE', 0.95),
(33, 'Cw', 'RH', 'RhCE', 0.70),
(34, 'Cx', 'RH', 'RhCE', 0.50),
(35, 'V', 'RH', 'RhCE', 0.60),
(36, 'VS', 'RH', 'RhCE', 0.60),
(37, 'hrB', 'RH', 'RhCE', 0.60),
(38, 'hrS', 'RH', 'RhCE', 0.60),
(39, 'Lua', 'LU', 'Lu', 0.50),
(40, 'Lub', 'LU', 'Lu', 0.50),
(41, 'K', 'KEL', 'Kel', 0.95),
(42, 'k', 'KEL', 'Kel', 0.95),
(43, 'Kpa', 'KEL', 'Kel', 0.80),
(44, 'Kpb', 'KEL', 'Kel', 0.80),
(45, 'Jsa', 'KEL', 'Kel', 0.70),
(46, 'Jsb', 'KEL', 'Kel', 0.70),
(47, 'Ku', 'KEL', 'Kel', 0.60),
(48, 'Ula', 'KEL', 'Kel', 0.40),
(49, 'K11', 'KEL', 'Kel', 0.30),
(50, 'K12', 'KEL', 'Kel', 0.30),
(51, 'K13', 'KEL', 'Kel', 0.30),
(52, 'K14', 'KEL', 'Kel', 0.30),
(53, 'VLAN', 'KEL', 'Kel', 0.20),
(54, 'TOU', 'KEL', 'Kel', 0.20),
(55, 'RAZ', 'KEL', 'Kel', 0.20),
(56, 'VONG', 'KEL', 'Kel', 0.20),
(57, 'KALT', 'KEL', 'Kel', 0.20),
(58, 'KTIM', 'KEL', 'Kel', 0.20),
(59, 'KYO', 'KEL', 'Kel', 0.20),
(60, 'KASH', 'KEL', 'Kel', 0.20),
(61, 'KELP', 'KEL', 'Kel', 0.20),
(62, 'KETI', 'KEL', 'Kel', 0.20),
(63, 'KHUL', 'KEL', 'Kel', 0.20),
(64, 'Fya', 'FY', 'Fy', 0.90),
(65, 'Fyb', 'FY', 'Fy', 0.90),
(66, 'Fy3', 'FY', 'Fy', 0.70),
(67, 'Fy5', 'FY', 'Fy', 0.50),
(68, 'Fy6', 'FY', 'Fy', 0.50),
(69, 'Jka', 'JK', 'Jk', 0.90),
(70, 'Jkb', 'JK', 'Jk', 0.90),
(71, 'Jk3', 'JK', 'Jk', 0.70),
(72, 'Dia', 'DI', 'Di', 0.80),
(73, 'Dib', 'DI', 'Di', 0.80),
(74, 'Wra', 'DI', 'Wr', 0.50),
(75, 'Wrb', 'DI', 'Wr', 0.50),
(76, 'ELO', 'DI', 'Di', 0.30),
(77, 'DISK', 'DI', 'Di', 0.20),
(78, 'Yta', 'YT', 'Yt', 0.60),
(79, 'Ytb', 'YT', 'Yt', 0.60),
(80, 'Sc1', 'SC', 'Sc', 0.40),
(81, 'Sc2', 'SC', 'Sc', 0.40),
(82, 'Doa', 'DO', 'Do', 0.70),
(83, 'Dob', 'DO', 'Do', 0.70),
(84, 'Hy', 'DO', 'Do', 0.50),
(85, 'Joa', 'DO', 'Do', 0.50),
(86, 'DOYA', 'DO', 'Do', 0.30),
(87, 'Coa', 'CO', 'Co', 0.70),
(88, 'Cob', 'CO', 'Co', 0.70),
(89, 'LWa', 'LW', 'LW', 0.50),
(90, 'LWab', 'LW', 'LW', 0.50),
(91, 'Ge2', 'GE', 'Ge', 0.50),
(92, 'Ge3', 'GE', 'Ge', 0.50),
(93, 'Ge4', 'GE', 'Ge', 0.50),
(94, 'Cra', 'CROM', 'Crom', 0.50),
(95, 'Tca', 'CROM', 'Crom', 0.30),
(96, 'Tcb', 'CROM', 'Crom', 0.30),
(97, 'Tcc', 'CROM', 'Crom', 0.30),
(98, 'Dra', 'CROM', 'Crom', 0.30),
(99, 'Esa', 'CROM', 'Crom', 0.20),
(100, 'Kna', 'KN', 'Kn', 0.30),
(101, 'Knb', 'KN', 'Kn', 0.30),
(102, 'McCa', 'KN', 'Kn', 0.30),
(103, 'Sl1', 'KN', 'Kn', 0.30),
(104, 'Yka', 'KN', 'Kn', 0.20),
(105, 'KCAM', 'KN', 'Kn', 0.20),
(106, 'Ina', 'IN', 'In', 0.40),
(107, 'Inb', 'IN', 'In', 0.40),
(108, 'Oka', 'OK', 'Ok', 0.30),
(109, 'JMH', 'JMH', 'JMH', 0.40),
(110, 'Duclos', 'RHAG', 'RHAG', 0.30),
(111, 'Jra', 'JR', 'Jr', 0.50),
(112, 'Lan', 'LAN', 'Lan', 0.50),
(113, 'Vel', 'VEL', 'Vel', 0.50),
(114, 'Ata', 'AUG', 'Aug', 0.30),
(115, 'Aub', 'AUG', 'Aug', 0.30)
ON CONFLICT (posicion_vector) DO NOTHING;

-- Fill remaining positions (116-443) as reserved
DO $$
BEGIN
    FOR i IN 116..443 LOOP
        INSERT INTO cat_antigenos (posicion_vector, nombre_antigeno, sistema_isbt, grupo_antigeno, peso_clinico)
        VALUES (i, 'Rsv_' || i, 'RSV', 'Reserved', 0.10)
        ON CONFLICT (posicion_vector) DO NOTHING;
    END LOOP;
END $$;

-- ============================================================
-- Seed default site and admin user
-- ============================================================
INSERT INTO sites (id, site_name, isbt_facility_code, cofepris_license, country_code)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'ABALAT S.A. de C.V. — Banco de Sangre Central',
    'MX-001',
    'COFEPRIS-BS-001',
    'MX'
) ON CONFLICT (id) DO NOTHING;

-- Admin user (password: admin123)
INSERT INTO users (id, site_id, username, full_name, email, password_hash)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    'Administrador del Sistema',
    'admin@abalat.mx',
    '$2a$12$LJ3m4ks9RLPuVVxJjfYqpeFMqIFqKXEPhWIire21tAqzB2k.X5L1C'
) ON CONFLICT (username) DO NOTHING;

-- Give admin all permissions
INSERT INTO screen_permissions (user_id, screen_key, can_view, can_create, can_edit, can_delete)
SELECT 
    'b0000000-0000-0000-0000-000000000001',
    screen,
    true, true, true, true
FROM unnest(ARRAY['dashboard','search','expediente','users','sites','import','audit','reports','settings']) AS screen
ON CONFLICT (user_id, screen_key) DO UPDATE SET
    can_view = true, can_create = true, can_edit = true, can_delete = true;
