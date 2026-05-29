# replit.nix - Nix package configuration for Replit
# Specifies the Node.js version and build tools

{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.typescript
  ];
}
