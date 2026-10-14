import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { ActorRole } from "@geo/domain";

const roleSchema = z.enum(["client", "ops", "agent", "website"]);
const userIdSchema = z.string().uuid();

export interface ActorContext {
  role: ActorRole;
  userId: string | null;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getActor(request: FastifyRequest): ActorContext {
  const role = roleSchema.parse(firstHeader(request.headers["x-actor-role"]));
  const rawUserId = firstHeader(request.headers["x-user-id"]);

  if (role !== "website" && !rawUserId) {
    throw new Error("x-user-id is required for human and Agent actions");
  }

  return {
    role,
    userId: rawUserId ? userIdSchema.parse(rawUserId) : null
  };
}
