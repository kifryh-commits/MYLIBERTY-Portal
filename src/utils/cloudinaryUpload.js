const CLOUD_NAME = "w1vndykv";
const UPLOAD_PRESET = "mylibertyies-f2f38";

// Uploads a file directly from the browser to Cloudinary's free tier
// and returns the permanent HTTPS URL of the uploaded image.
export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Upload failed");
  return data.secure_url;
}
