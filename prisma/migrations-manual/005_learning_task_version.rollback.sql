-- Apply only after task writers are stopped and task rows have been exported.
ALTER TABLE "LearningTask" DROP COLUMN "version";
