{
  description = "Operator-Synaciel Playwright development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs = {nixpkgs, ...}: let
    systems = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    forAllSystems = nixpkgs.lib.genAttrs systems;
  in {
    devShells = forAllSystems (system: let
      pkgs = import nixpkgs {inherit system;};
      lib = pkgs.lib;

      linuxLibraries =
        if pkgs.stdenv.isLinux
        then
          with pkgs; [
            atk
            at-spi2-atk
            at-spi2-core
            udev
            libffi
            libxml2_13
            libxslt
            openssl
            readline
            sqlite
            stdenv.cc.cc.lib
            zlib

            gtk3
            gtk4
            glib
            gdk-pixbuf
            pango
            cairo
            harfbuzz
            harfbuzzFull
            icu
            icu74

            gst_all_1.gstreamer
            gst_all_1.gst-plugins-base
            gst_all_1.gst-plugins-good
            gst_all_1.gst-plugins-bad
            gst_all_1.gst-plugins-ugly
            gst_all_1.gst-libav

            mesa
            libgbm
            libglvnd
            libdrm
            libxcb
            xorg.libX11
            xorg.libXcursor
            xorg.libXdamage
            xorg.libXcomposite
            xorg.libXext
            xorg.libXfixes
            xorg.libXi
            xorg.libXrandr
            xorg.libXrender
            wayland
            libxkbcommon
            vulkan-loader
            graphene

            nss
            nspr
            alsa-lib
            cups
            dbus
            expat
            fontconfig
            freetype
            woff2
            lcms2
            libsecret
            libnotify
            libproxy
            libmanette
            libjpeg8
            libpng
            libwebp
            libavif
            dav1d

            libevent
            libopus
            libgcrypt
            libgpg-error
            flite
            libepoxy
            enchant2
            libtasn1
            hyphen
            libpsl
            nghttp2
          ]
        else [];

      gstreamerPlugins =
        if pkgs.stdenv.isLinux
        then
          with pkgs; [
            gst_all_1.gstreamer
            gst_all_1.gst-plugins-base
            gst_all_1.gst-plugins-good
            gst_all_1.gst-plugins-bad
            gst_all_1.gst-plugins-ugly
            gst_all_1.gst-libav
          ]
        else [];

      linuxLibraryPath = lib.makeLibraryPath linuxLibraries;
      gstreamerPluginPath = lib.makeSearchPath "lib/gstreamer-1.0" gstreamerPlugins;
      linuxEnvironment = lib.optionalString pkgs.stdenv.isLinux ''
        export LD_LIBRARY_PATH="${linuxLibraryPath}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        export NIX_LD_LIBRARY_PATH="${linuxLibraryPath}''${NIX_LD_LIBRARY_PATH:+:$NIX_LD_LIBRARY_PATH}"
        export GST_PLUGIN_SYSTEM_PATH_1_0="${gstreamerPluginPath}''${GST_PLUGIN_SYSTEM_PATH_1_0:+:$GST_PLUGIN_SYSTEM_PATH_1_0}"
      '';
    in {
      default = pkgs.mkShell {
        packages = linuxLibraries;
        shellHook = ''
          export PLAYWRIGHT_BROWSERS_PATH="''${PLAYWRIGHT_BROWSERS_PATH:-$PWD/.playwright-browsers}"
          export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="''${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-1}"
          ${linuxEnvironment}
        '';
      };
    });
  };
}
