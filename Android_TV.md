# Android TV

## Install a new launcher

Good replacement launchers include:

- [Projectivy Launcher](https://play.google.com/store/apps/details?id=com.spocky.projengmenu)
- [FLauncher](https://play.google.com/store/apps/details?id=me.efesser.flauncher)

## Nvidia Shield

The following ADB commands disable the built in launcher

    pm disable-user --user 0 com.google.android.tvlauncher
    pm disable-user --user 0 com.google.android.tvrecommendations

## Chromecast with Google TV

The following ADB commands disable the built in launcher

    pm disable-user --user 0 com.google.android.apps.tv.launcherx
    pm disable-user --user 0 com.google.android.tungsten.setupwraith
