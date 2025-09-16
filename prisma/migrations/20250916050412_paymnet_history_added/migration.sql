-- CreateTable
CREATE TABLE "payment_histories" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "enrollment_payment_id" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "payment_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_histories" ADD CONSTRAINT "payment_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_histories" ADD CONSTRAINT "payment_histories_enrollment_payment_id_fkey" FOREIGN KEY ("enrollment_payment_id") REFERENCES "enrollment_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
