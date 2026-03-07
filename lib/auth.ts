import { User } from "@prisma/client";
import { JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ROLES, Role } from "@/lib/constants";

const SESSION_COOKIE = "studde_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "lokal-studde-hemlighet",
);

export type SessionUser = {
  userId: string;
  username: string;
  name: string;
  role: Role;
};

type SessionPayload = JWTPayload & SessionUser;

export async function createSession(user: Pick<User, "id" | "username" | "name" | "role">) {
  const token = await new SignJWT({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  } satisfies SessionUser)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(SESSION_SECRET);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, SESSION_SECRET);
    return verified.payload as SessionPayload;
  } catch {
    clearSession();
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

export async function requireRole(role: Role) {
  const session = await requireSession();

  if (session.role !== role) {
    redirect(session.role === ROLES.ADMIN ? "/admin" : "/student");
  }

  return session;
}
