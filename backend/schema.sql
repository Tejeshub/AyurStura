-- AyurSutra database schema for MySQL.
-- Run this once in MySQL Workbench (or mysql CLI) after creating the database.
-- Usage: CREATE DATABASE IF NOT EXISTS ayursutra_db; USE ayursutra_db; then run this file.

-- Users: all roles (patient, doctor, admin). Doctors have a linked doctors row.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('patient', 'doctor', 'admin') NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- Doctors: extended profile for users with role 'doctor'.
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialization VARCHAR(255) DEFAULT NULL,
  license_number VARCHAR(100) DEFAULT NULL,
  consultation_duration_min INT DEFAULT 30,
  consultation_fee DECIMAL(10, 2) DEFAULT NULL,
  break_minutes INT DEFAULT 15,
  bio TEXT DEFAULT NULL,
  is_available TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_available (is_available)
);

-- Appointments: patient bookings with a doctor.
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  type ENUM('consultation', 'follow-up', 'panchakarma', 'therapy') NOT NULL,
  -- Patient selects only preferred date (no time). Doctor later confirms exact 1-hour slot.
  appointment_date DATE NOT NULL COMMENT 'Preferred date requested by patient',
  appointment_time TIME DEFAULT NULL COMMENT 'Preferred time (unused; kept for backwards compatibility)',
  confirmed_date DATE DEFAULT NULL COMMENT 'Final confirmed date chosen by doctor',
  confirmed_time TIME DEFAULT NULL COMMENT 'Final confirmed start time (1-hour slot) chosen by doctor',
  reschedule_proposed_date DATE DEFAULT NULL COMMENT 'New proposed date chosen by doctor (waiting patient confirmation)',
  reschedule_proposed_time TIME DEFAULT NULL COMMENT 'New proposed start time chosen by doctor (waiting patient confirmation)',
  symptoms TEXT DEFAULT NULL,
  status ENUM('pending', 'confirmed', 'reschedule_required', 'reschedule_proposed', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  INDEX idx_patient (patient_id),
  INDEX idx_doctor (doctor_id),
  INDEX idx_date (appointment_date),
  INDEX idx_status (status)
);

-- Doctor emergency full-day unavailability (affects confirmed appointments on that day).
CREATE TABLE IF NOT EXISTS doctor_unavailable_days (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  unavailable_date DATE NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  UNIQUE KEY unique_doctor_unavailable_day (doctor_id, unavailable_date),
  INDEX idx_unavailable_date (unavailable_date)
);

-- Doctor weekly availability (day 0 = Sunday, 6 = Saturday).
CREATE TABLE IF NOT EXISTS doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Sun, 1=Mon, ..., 6=Sat',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  UNIQUE KEY unique_doctor_day (doctor_id, day_of_week)
);

-- Clinic/settings: single row for admin-configured clinic info and preferences.
CREATE TABLE IF NOT EXISTS clinic_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinic_name VARCHAR(255) DEFAULT 'AyurVeda Clinic',
  contact_email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  address VARCHAR(500) DEFAULT NULL,
  email_notifications TINYINT(1) DEFAULT 1,
  sms_reminders TINYINT(1) DEFAULT 1,
  auto_confirm_appointments TINYINT(1) DEFAULT 0,
  default_appointment_duration_min INT DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default clinic settings if empty.
INSERT INTO clinic_settings (id, clinic_name, contact_email, phone, address)
SELECT 1, 'AyurVeda Clinic', 'admin@ayurvedaclinic.com', '+91 98765 43210', '123 Wellness Street, Health City'
WHERE NOT EXISTS (SELECT 1 FROM clinic_settings LIMIT 1);
