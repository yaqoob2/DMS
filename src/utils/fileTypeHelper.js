const path = require("path");

const getFileTypeInfo = (originalName, mimeType) => {
    const ext = path.extname(originalName).toLowerCase();
    
    // PDF
    if (ext === ".pdf" || mimeType === "application/pdf") {
        return {
            fileType: "pdf",
            previewType: "pdf",
            canPreview: true,
            iconType: "pdf"
        };
    }

    // Image
    if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) || (mimeType && mimeType.startsWith("image/"))) {
        return {
            fileType: "image",
            previewType: "image",
            canPreview: true,
            iconType: "image"
        };
    }

    // Text
    if ([".txt", ".csv", ".json"].includes(ext) || ["text/plain", "text/csv", "application/json"].includes(mimeType)) {
        return {
            fileType: "text",
            previewType: "text",
            canPreview: true,
            iconType: "text"
        };
    }

    // Word
    if ([".doc", ".docx"].includes(ext)) {
        return {
            fileType: "word",
            previewType: "unsupported",
            canPreview: false,
            iconType: "word"
        };
    }

    // Excel
    if ([".xls", ".xlsx"].includes(ext)) {
        return {
            fileType: "excel",
            previewType: "unsupported",
            canPreview: false,
            iconType: "excel"
        };
    }

    // PowerPoint
    if ([".ppt", ".pptx"].includes(ext)) {
        return {
            fileType: "powerpoint",
            previewType: "unsupported",
            canPreview: false,
            iconType: "powerpoint"
        };
    }

    // ZIP / Archive
    if ([".zip", ".rar", ".7z"].includes(ext)) {
        return {
            fileType: "archive",
            previewType: "unsupported",
            canPreview: false,
            iconType: "zip"
        };
    }

    // Default
    return {
        fileType: "file",
        previewType: "unsupported",
        canPreview: false,
        iconType: "file"
    };
};

module.exports = { getFileTypeInfo };
