import io
import re
import warnings
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException
from ..core.config import ROOT, get_settings
Image.MAX_IMAGE_PIXELS=20_000_000
IMAGE_NAME=re.compile(r"^[0-9a-f-]{36}\.webp$")
INTERNAL_IMAGE=re.compile(r"^/api/project-images/([0-9a-f-]{36})/([0-9a-f-]{36}\.webp)$")
def encode_image(raw):
    if len(raw)>get_settings().upload_max_bytes:
        raise HTTPException(413,"Images must be smaller than 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error",Image.DecompressionBombWarning)
            image=Image.open(io.BytesIO(raw))
            if image.format not in ("JPEG","PNG","WEBP") or image.width*image.height>20_000_000:raise ValueError()
            image.load();image.thumbnail((2048,2048))
            output=io.BytesIO();image.convert("RGB").save(output,format="WEBP",quality=85)
            return output.getvalue()
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise HTTPException(400,"Upload a valid PNG, JPEG, or WebP image up to 20 megapixels.")
def project_path(project_id,filename):
    return ROOT.joinpath("storage","project-images",project_id,filename)
def remove_project_images(project,kept=(),images=None):
    for url in project.screenshots if images is None else images:
        match=INTERNAL_IMAGE.fullmatch(url)
        if match and match[1]==project.id and url not in kept:project_path(project.id,match[2]).unlink(missing_ok=True)

