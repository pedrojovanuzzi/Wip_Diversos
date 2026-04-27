"use client";

import dynamic from "next/dynamic";
import type { User } from "@/lib/auth";

const MapInner = dynamic(() => import("./MapInner"), { ssr: false });

export default function MapClient({ user }: { user: User }) {
  return <MapInner user={user} />;
}
