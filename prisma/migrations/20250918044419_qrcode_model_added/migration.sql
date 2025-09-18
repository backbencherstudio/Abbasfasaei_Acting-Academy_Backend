-- CreateTable
CREATE TABLE "qr_attendance_sessions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "qr_attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qr_attendance_sessions_token_key" ON "qr_attendance_sessions"("token");

-- CreateIndex
CREATE INDEX "qr_attendance_sessions_token_idx" ON "qr_attendance_sessions"("token");

-- CreateIndex
CREATE INDEX "qr_attendance_sessions_class_id_idx" ON "qr_attendance_sessions"("class_id");

-- CreateIndex
CREATE INDEX "qr_attendance_sessions_expires_at_idx" ON "qr_attendance_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "qr_attendance_sessions_is_active_idx" ON "qr_attendance_sessions"("is_active");

-- AddForeignKey
ALTER TABLE "qr_attendance_sessions" ADD CONSTRAINT "qr_attendance_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "module_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_attendance_sessions" ADD CONSTRAINT "qr_attendance_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
