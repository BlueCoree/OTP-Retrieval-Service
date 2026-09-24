-- CreateTable
CREATE TABLE "otp_emails" (
    "id" SERIAL NOT NULL,
    "sender_email" TEXT NOT NULL,
    "email_subject" TEXT NOT NULL,
    "email_body" TEXT NOT NULL,
    "email_sent_at" TIMESTAMP(3) NOT NULL,
    "otp_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_emails_sender_email_email_sent_at_key" ON "otp_emails"("sender_email", "email_sent_at");
