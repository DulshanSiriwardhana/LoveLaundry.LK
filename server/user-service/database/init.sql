CREATE TABLE user (
    user_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(50) NOT NULL,
    address_line2 VARCHAR(50),
    address_line3 VARCHAR(50),
    profile_picture VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role_id VARCHAR(50) REFERENCES role(role_id) DEFAULT '0'
);

CREATE TABLE role (
    role_id VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(50),
    level VARCHAR(50)
);