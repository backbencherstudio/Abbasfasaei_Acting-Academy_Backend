-- CreateTable
CREATE TABLE "public"."_VisibilityAllowedFriends" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_VisibilityAllowedFriends_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_VisibilityAllowedFriends_B_index" ON "public"."_VisibilityAllowedFriends"("B");

-- AddForeignKey
ALTER TABLE "public"."_VisibilityAllowedFriends" ADD CONSTRAINT "_VisibilityAllowedFriends_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_VisibilityAllowedFriends" ADD CONSTRAINT "_VisibilityAllowedFriends_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
