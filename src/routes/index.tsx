import { createFileRoute } from "@tanstack/react-router";
import { StoneDuel } from "@/game/StoneDuel";

export const Route = createFileRoute("/")({ component: StoneDuel });
