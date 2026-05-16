import { CreateAssignmentDto } from "./create-assignment.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) { }
