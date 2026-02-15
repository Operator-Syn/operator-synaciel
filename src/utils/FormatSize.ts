// utils/FormatSize.ts
export function formatBytes(bytes: number, decimals = 0) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

const getIcon = (format: string | null, type: "dir" | "file") => {
   if (type === 'dir') return "📁";
   if (format === 'pdf') return "📕";
   if (format === 'md') return "📝"; 
   return "📄"; 
};

// Usage in your Table:
// <td className="text-end">{formatBytes(item.size_bytes)}</td>