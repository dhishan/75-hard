import os
import uuid
from datetime import timedelta
from google.cloud import storage


def _get_client():
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        return storage.Client.create_anonymous_client()
    return storage.Client()


def generate_upload_url(bucket_name: str, object_path: str, content_type: str = "image/jpeg") -> str:
    """Return a URL for direct upload. Uses emulator direct URL in local env."""
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        return f"http://{emulator}/upload/storage/v1/b/{bucket_name}/o?uploadType=media&name={object_path}"
    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_path)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type=content_type,
    )


def generate_download_url(bucket_name: str, object_path: str) -> str:
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        return f"http://{emulator}/download/storage/v1/b/{bucket_name}/o/{object_path}?alt=media"
    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_path)
    return blob.generate_signed_url(
        version="v4", expiration=timedelta(hours=1), method="GET"
    )


def delete_object(bucket_name: str, object_path: str) -> None:
    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_path)
    blob.delete()
