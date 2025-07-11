import {z} from 'zod';

export const UserRegisterValidationSchema = z.object({
    name: z.string().min(1, "Name is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    bio: z.string().min(1, "Bio is required"),
});

export const UserLoginValidationSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
