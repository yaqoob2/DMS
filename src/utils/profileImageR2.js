const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const r2Client = require("../config/r2Client");

const bucketName = process.env.R2_BUCKET_NAME;

const cleanFileName = (fileName = "profile.jpg") => {
    return fileName
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .toLowerCase();
};

const createProfileImageKey = (userId, originalName) => {
    const timestamp = Date.now();
    const safeFileName = cleanFileName(originalName);

    return `profile-pics/${userId}-${timestamp}-${safeFileName}`;
};

const uploadProfileImageToR2 = async ({ userId, file }) => {
    const key = createProfileImageKey(userId, file.originalname);

    await r2Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        })
    );

    return key;
};

const getSignedProfileImageUrl = async (profileImageKey) => {
    if (!profileImageKey) return null;

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: profileImageKey,
    });

    return getSignedUrl(r2Client, command, {
        expiresIn: Number(process.env.R2_SIGNED_URL_EXPIRES_SECONDS || 3600),
    });
};

const deleteProfileImageFromR2 = async (profileImageKey) => {
    if (!profileImageKey) return;

    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: profileImageKey,
            })
        );
    } catch (error) {
        console.error("Old profile image delete failed:", error.message);
    }
};

module.exports = {
    uploadProfileImageToR2,
    getSignedProfileImageUrl,
    deleteProfileImageFromR2,
};