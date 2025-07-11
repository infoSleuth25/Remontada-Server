import { z } from "zod";

const GroupCreateSchema = z.object({
  groupName: z.string().min(1, "Group name is required"),
  groupMembers: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId format"))
    .min(2, "Group must have at least 2 members excluding Creator of group"),
});

export { GroupCreateSchema };
