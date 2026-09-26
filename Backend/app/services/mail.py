import json
import smtplib
import logging
from email.message import EmailMessage
from ..core.config import get_settings, ROOT

def send_reset(email, token):
    settings = get_settings()
    link = settings.frontend_url.rstrip("/") + "/reset-password?token=" + token
    if not settings.smtp_host:
        if settings.environment == "development":
            folder = ROOT / "storage" / "outbox"
            folder.mkdir(exist_ok=True)
            import uuid
            folder.joinpath(str(uuid.uuid4()) + ".json").write_text(
                json.dumps({"to": email, "reset_url": link}), encoding="utf-8")
        return
    message = EmailMessage()
    message["Subject"] = "Reset your King AI workspace password"
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(f"Reset your password within 20 minutes:\n{link}\nIgnore this email if you did not request it.")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException):
        logging.getLogger(__name__).error("Password recovery email could not be delivered; check SMTP configuration.")

