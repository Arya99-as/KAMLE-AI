import type { Request, Response } from "express";
import User from "../models/User.js";
import WorkerProfile from "../models/WorkerProfile.js";
import ApiError from "../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import type { LoginInput, RegisterInput, UpdateMeInput } from "../validators/auth.js";

function publicUser(user: InstanceType<typeof User>) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email ?? "",
    phone: user.phone,
    role: user.role,
    accountStatus: user.accountStatus,
    avatarUrl: user.avatarUrl ?? "",
    location: user.location ?? "",
    createdAt: user.createdAt,
  };
}

export async function register(req: Request<unknown, unknown, RegisterInput>, res: Response) {
  const { name, phone, email, password, role, location } = req.body;

  const existingPhone = await User.findOne({ phone });
  if (existingPhone) throw ApiError.conflict("An account with this phone number already exists");
  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    phone,
    email: email ? email.toLowerCase() : undefined,
    passwordHash,
    role,
    location: location || "",
  });

  if (role === "worker") {
    await WorkerProfile.create({ userId: user._id, approvalStatus: "draft" });
  }

  const token = signToken({ sub: String(user._id), role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req: Request<unknown, unknown, LoginInput>, res: Response) {
  const body = req.body;
  const identifier = body.identifier || body.phone || body.email;
  if (!identifier) throw ApiError.badRequest("Provide a phone number or email");

  const query = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { phone: identifier.trim() };

  const user = await User.findOne(query).select("+passwordHash");
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid credentials");
  if (user.accountStatus === "suspended") throw ApiError.forbidden("This account is suspended");

  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized("Invalid credentials");

  const token = signToken({ sub: String(user._id), role: user.role });
  res.json({ token, user: publicUser(user) });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized("Account no longer exists");

  let workerProfile = null;
  if (user.role === "worker") {
    workerProfile = await WorkerProfile.findOne({ userId: user._id }).lean().exec();
  }

  res.json({ user: publicUser(user), workerProfile });
}

export async function updateMe(req: Request<unknown, unknown, UpdateMeInput>, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized("Account no longer exists");

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.location !== undefined) user.location = req.body.location;
  await user.save();

  res.json({ user: publicUser(user) });
}
