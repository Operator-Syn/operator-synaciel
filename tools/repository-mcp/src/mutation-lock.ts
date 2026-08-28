let activeMutation: Promise<unknown> | null = null;

export async function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  if (activeMutation) throw new Error("Another repository mutation is already in progress.");

  const current = operation();
  activeMutation = current;
  try {
    return await current;
  } finally {
    if (activeMutation === current) activeMutation = null;
  }
}
