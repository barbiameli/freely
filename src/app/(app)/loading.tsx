import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Shown while any page in the app is being built on the server.
 *
 * One file covers every route in this group, since they share a layout and a
 * rough shape. Individual routes can override it with their own loading.tsx
 * where the shape is different enough to be worth it.
 */
export default function Loading() {
  return <PageSkeleton />;
}
