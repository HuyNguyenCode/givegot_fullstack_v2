-- G1: additive optimistic-lock version for existing and future tasks.
ALTER TABLE "LearningTask" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
