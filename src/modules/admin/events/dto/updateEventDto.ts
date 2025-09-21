import { PartialType } from "@nestjs/swagger";
import { addEventDto } from "./addevent.dto";

export class updateEventDto extends PartialType(addEventDto) {}