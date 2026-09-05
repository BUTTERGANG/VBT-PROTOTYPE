# replit.nix - Nix package configuration for Replit
# Specifies the Node.js version, build tools, and Python for the autoregulate service

{ pkgs }: {
  deps = [
    pkgs.unpackerr
    pkgs.nodejs_22
    pkgs.nodePackages.typescript
    pkgs.python311
    pkgs.python311Packages.fastapi
    pkgs.python311Packages.uvicorn
    pkgs.python311Packages.pydantic
    pkgs.python311Packages.httpx
  ];
}
