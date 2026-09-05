import { createFileRoute } from "@tanstack/react-router";
import { CubeApp } from "@/components/cube/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CubeApp />;
}
