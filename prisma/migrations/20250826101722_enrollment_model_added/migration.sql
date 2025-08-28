-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('ONE_YEAR_ADULT', 'TWO_YEAR_ADULT', 'TWO_YEAR_KIDS', 'FULL_PACKAGE_KIDS', 'FULL_PACKAGE_ADULTS');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ONE_TIME', 'MONTHLY_INSTALLMENTS');

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "course" "CourseType" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "experience_level" "ExperienceLevel" NOT NULL,
    "acting_goals" TEXT NOT NULL,
    "digital_signature" TEXT NOT NULL,
    "signature_date" TIMESTAMP(3) NOT NULL,
    "agreed_rules" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentPayment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_type" "PaymentType" NOT NULL,
    "payment_method" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "card_number" TEXT NOT NULL,
    "card_expiry" TEXT NOT NULL,
    "card_cvc" TEXT NOT NULL,
    "invoice_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EnrollmentPayment_pkey" PRIMARY KEY ("id")
);
