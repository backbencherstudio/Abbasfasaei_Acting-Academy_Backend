UPDATE enrollments SET payment_type = 'MONTHLY' WHERE payment_type = 'YEARLY';
UPDATE enrollment_payments SET payment_type = 'MONTHLY' WHERE payment_type = 'YEARLY';
UPDATE payment_histories SET payment_type = 'MONTHLY' WHERE payment_type = 'YEARLY';
