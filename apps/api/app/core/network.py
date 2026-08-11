from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

from apps.api.app.core.settings import Settings


class EndpointPolicyError(ValueError):
    pass


def normalize_base_url(url: str, *, allow_insecure_http: bool) -> str:
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise EndpointPolicyError("Endpoint URL must use http or https")
    if parsed.scheme == "http" and not allow_insecure_http:
        raise EndpointPolicyError("Plain HTTP endpoints are disabled")
    if not parsed.hostname or parsed.username or parsed.password:
        raise EndpointPolicyError("Endpoint URL must contain a host and no embedded credentials")
    if parsed.query or parsed.fragment:
        raise EndpointPolicyError("Endpoint URL cannot contain query parameters or a fragment")
    path = parsed.path.rstrip("/")
    if not path.endswith("/v1"):
        path = f"{path}/v1" if path else "/v1"
    netloc = parsed.hostname
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"
    return urlunsplit((parsed.scheme, netloc, path, "", ""))


async def validate_endpoint_url(url: str, settings: Settings) -> str:
    normalized = normalize_base_url(url, allow_insecure_http=settings.allow_insecure_http)
    hostname = urlsplit(normalized).hostname
    assert hostname is not None
    if hostname.lower() in {host.lower() for host in settings.allowed_endpoint_hosts}:
        return normalized

    try:
        literal_ip = ipaddress.ip_address(hostname)
        addresses = {literal_ip}
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            records = await loop.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise EndpointPolicyError(f"Endpoint hostname cannot be resolved: {hostname}") from exc
        addresses = {ipaddress.ip_address(record[4][0]) for record in records}

    allowed_networks = [ipaddress.ip_network(cidr) for cidr in settings.allowed_endpoint_cidrs]
    forbidden = [
        ipaddress.ip_network("169.254.0.0/16"),
        ipaddress.ip_network("fe80::/10"),
        ipaddress.ip_network("0.0.0.0/8"),
        ipaddress.ip_network("::/128"),
    ]
    for address in addresses:
        if address.is_loopback or any(address in network for network in forbidden):
            raise EndpointPolicyError(f"Endpoint address is forbidden: {address}")
        if not any(address in network for network in allowed_networks):
            raise EndpointPolicyError(
                f"Endpoint address is outside the configured allowlist: {address}"
            )
    return normalized
