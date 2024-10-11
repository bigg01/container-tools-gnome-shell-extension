import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import PangoCairo from 'gi://PangoCairo';
import Gtk from 'gi://Gtk';

const { ByteArray } = imports.gi.GLib;
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export default class ExampleExtension {
    enable() {
        // Create a panel button
        this._indicator = new PanelMenu.Button(0.0, 'Example Extension', false);

        // Create a vertical box layout
        const box = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Create a horizontal box layout for the label
        const labelBox = new St.BoxLayout({
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Add an icon
        const icon = new St.Icon({
            icon_name: 'system-run-symbolic',
            style_class: 'system-status-icon',
        });

        // Add text
        const label = new St.Label({
            text: 'Linux Containers',
        });

        // Add icon and label to the label box layout
        labelBox.add_child(icon);
        labelBox.add_child(label);

        // Add the label box layout to the main box layout
        box.add_child(labelBox);

        // Add the box layout to the indicator
        this._indicator.add_child(box);

        // Create a dropdown menu for containers
        const menu = this._indicator.menu;

        // Add a submenu for running containers
        this.containersSubMenu = new PopupMenu.PopupSubMenuMenuItem('Running Containers');
        menu.addMenuItem(this.containersSubMenu);

        // Add a submenu for stopped containers
        this.stoppedContainersSubMenu = new PopupMenu.PopupSubMenuMenuItem('Stopped Containers');
        menu.addMenuItem(this.stoppedContainersSubMenu);

        // Add a submenu for metrics
        this.metricsSubMenu = new PopupMenu.PopupSubMenuMenuItem('Metrics');
        menu.addMenuItem(this.metricsSubMenu);


        // Add icons and labels for metrics
        this.runningContainersLabel = new St.Label({ text: 'Running Containers: 0' });
        this.imagesLabel = new St.Label({ text: 'Images: 0' });
        this.volumesLabel = new St.Label({ text: 'Volumes: 0' });

        const runningContainersIcon = new St.Icon({
            icon_name: 'media-playback-start-symbolic',
            style_class: 'system-status-icon',
        });

        const imagesIcon = new St.Icon({
            icon_name: 'folder-documents-symbolic',
            style_class: 'system-status-icon',
        });

        const volumesIcon = new St.Icon({
            icon_name: 'drive-harddisk-symbolic',
            style_class: 'system-status-icon',
        });

        const runningContainersBox = new St.BoxLayout({ vertical: false });
        runningContainersBox.add_child(runningContainersIcon);
        runningContainersBox.add_child(this.runningContainersLabel);

        const imagesBox = new St.BoxLayout({ vertical: false });
        imagesBox.add_child(imagesIcon);
        imagesBox.add_child(this.imagesLabel);

        const volumesBox = new St.BoxLayout({ vertical: false });
        volumesBox.add_child(volumesIcon);
        volumesBox.add_child(this.volumesLabel);

        const runningContainersMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        runningContainersMenuItem.add_child(runningContainersBox);
        this.metricsSubMenu.menu.addMenuItem(runningContainersMenuItem);

        const imagesMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        imagesMenuItem.add_child(imagesBox);
        this.metricsSubMenu.menu.addMenuItem(imagesMenuItem);

        const volumesMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        volumesMenuItem.add_child(volumesBox);
        this.metricsSubMenu.menu.addMenuItem(volumesMenuItem);

        // Add a cleanup function
        this.cleanup = () => {
            const containerCommand = GLib.find_program_in_path('docker') ? 'docker' : GLib.find_program_in_path('podman') ? 'podman' : null;

            if (!containerCommand) {
                Main.notify('Neither Docker nor Podman is available');
                return;
            }

            // Stop all containers
            log("${containerCommand} ps -a -q");
            const [successStop, outputStop] = GLib.spawn_command_line_sync(`${containerCommand} ps -a -q`);
            // log the output
            log("Hello containers");
            log(ByteArray.toString(outputStop));
            log("Hello containers");
            log(ByteArray.toString(successStop));
            if (successStop) {
                const containers = ByteArray.toString(outputStop).trim().split('\n').filter(Boolean);
                log(`Containers to stop: ${containers.join(', ')}`);
                containers.forEach(container => {
                    GLib.spawn_command_line_async(`${containerCommand} stop ${container}`);
                });
            }

            // Remove all containers
            const [successRm, outputRm] = GLib.spawn_command_line_sync(`${containerCommand} ps -a -q`);
            if (successRm) {
                const containers = ByteArray.toString(outputRm).trim().split('\n').filter(Boolean);
                containers.forEach(container => {
                    GLib.spawn_command_line_async(`${containerCommand} rm ${container}`);
                });
            }

            // Remove all images
            const [successRmi, outputRmi] = GLib.spawn_command_line_sync(`${containerCommand} images -q`);
            if (successRmi) {
                const images = ByteArray.toString(outputRmi).trim().split('\n').filter(Boolean);
                images.forEach(image => {
                    GLib.spawn_command_line_async(`${containerCommand} rmi ${image}`);
                });
            }

            // Remove all volumes
            const [successVolumeRm, outputVolumeRm] = GLib.spawn_command_line_sync(`${containerCommand} volume ls -q`);
            if (successVolumeRm) {
                const volumes = outputVolumeRm.toString().trim().split('\n').filter(Boolean);
                volumes.forEach(volume => {
                    GLib.spawn_command_line_async(`${containerCommand} volume rm ${volume}`);
                });
            }

            //Main.notify('Cleanup completed');
        };

        // Add a menu item for cleanup with confirmation dialog
        const cleanupMenuItem = new PopupMenu.PopupMenuItem('Cleanup (stop all containers, remove all containers, images, and volumes)');
        cleanupMenuItem.connect('activate', () => {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'prompt-dialog',
                destroyOnClose: true,
            });

            dialog.contentLayout.add_child(new St.Label({ text: 'Are you sure you want to cleanup all containers and images?' }));

            dialog.setButtons([
                {
                    label: 'Cancel',
                    action: () => dialog.close(),
                    key: Clutter.KEY_Escape,
                },
                {
                    label: 'Cleanup',
                    action: () => {
                        this.cleanup();
                        dialog.close();
                    },
                    default: true,
                },
            ]);

            dialog.open();
        });
        menu.addMenuItem(cleanupMenuItem);

        // Function to refresh the list of running containers and metrics
        this._refreshContainersAndMetrics();

        // Refresh every 10 seconds
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._refreshContainersAndMetrics();
            return GLib.SOURCE_CONTINUE;
        });

        // Create a label with markup
        let about_label = new St.Label({
            text: '\u00A9 http://www.containerize.ch',
            style_class: 'about-label',
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });

        // Wrap the label in a PopupBaseMenuItem
        const aboutMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        aboutMenuItem.add_child(about_label);

        // Add the wrapped label to the about submenu
        this.aboutSubMenu = new PopupMenu.PopupSubMenuMenuItem('About');
        this.aboutSubMenu.menu.addMenuItem(aboutMenuItem);
        menu.addMenuItem(this.aboutSubMenu);


        // Add the indicator to the panel
        //Main.panel.addToStatusArea('example-extension', this._indicator);
        Main.panel.addToStatusArea('container-tools@gnome-shell-extensions.containerize.ch', this._indicator);
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        this._indicator?.destroy();
        this._indicator = null;
    }

    _refreshContainersAndMetrics() {
        // Determine whether to use docker or podman
        const containerCommand = GLib.find_program_in_path('docker') ? 'docker' : GLib.find_program_in_path('podman') ? 'podman' : null;

        if (!containerCommand) {
            this.containersSubMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem('Neither Docker nor Podman is available'));
            this.runningContainersLabel.set_text('Running Containers: 0');
            this.imagesLabel.set_text('Images: 0');
            this.volumesLabel.set_text('Volumes: 0');
            return;
        }

        // Clear existing items
        this.containersSubMenu.menu.removeAll();
        this.stoppedContainersSubMenu.menu.removeAll();

        // Fetch running containers
        // --format "Names: {{.Names}}\t Image: {{.Image}}\t Command: {{.Command}}"
        const [successRunningContainers, outputRunningContainers] = GLib.spawn_command_line_sync(`${containerCommand} ps --filter "status=running" --format "{{.Names}}"`);
        if (successRunningContainers) {
            const runningContainers = outputRunningContainers.toString().trim().split('\n').filter(Boolean);
            runningContainers.forEach(container => {
                const containerBox = new St.BoxLayout({ vertical: false });

                // Add stop action
                const stopButton = new St.Button({ label: '<click to stop> ' });
                stopButton.connect('clicked', () => {
                    log(`${containerCommand} stop ${container}`);
                    GLib.spawn_command_line_async(`${containerCommand} stop ${container}`);
                });

                const containerLabel = new St.Label({ text: container });

                containerBox.add_child(stopButton);
                containerBox.add_child(containerLabel);

                const containerMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
                containerMenuItem.add_child(containerBox);
                this.containersSubMenu.menu.addMenuItem(containerMenuItem);
            });
            this.runningContainersLabel.set_text(`Running Containers: ${runningContainers.length}`);
        } else {
            this.containersSubMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem('Failed to fetch running containers'));
            this.runningContainersLabel.set_text('Running Containers: 0');
        }

        // Fetch stopped containers
        const [successStoppedContainers, outputStoppedContainers] = GLib.spawn_command_line_sync(`${containerCommand} ps -a --filter "status=stopped" --format "{{.Names}}"`);
        if (successStoppedContainers) {
            const stoppedContainers = outputStoppedContainers.toString().trim().split('\n').filter(Boolean);
            stoppedContainers.forEach(container => {
                const containerBox = new St.BoxLayout({ vertical: false });

                // Add start action
                const startButton = new St.Button({ label: 'Start -> ' });
                startButton.connect('clicked', () => {
                    GLib.spawn_command_line_async(`${containerCommand} start ${container}`);
                });

                const containerLabel = new St.Label({ text: container });

                containerBox.add_child(startButton);
                containerBox.add_child(containerLabel);

                const containerMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
                containerMenuItem.add_child(containerBox);
                this.stoppedContainersSubMenu.menu.addMenuItem(containerMenuItem);
            });
        } else {
            this.stoppedContainersSubMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem('Failed to fetch stopped containers'));
        }

        // Fetch container images
        const [successImages, outputImages] = GLib.spawn_command_line_sync(`${containerCommand} images -q`);
        if (successImages) {
            const images = outputImages.toString().trim().split('\n').filter(Boolean);
            this.imagesLabel.set_text(`Images: ${images.length}`);
        } else {
            this.imagesLabel.set_text('Images: 0');
        }

        // Fetch container volumes
        const [successVolumes, outputVolumes] = GLib.spawn_command_line_sync(`${containerCommand} volume ls -q`);
        if (successVolumes) {
            const volumes = outputVolumes.toString().trim().split('\n').filter(Boolean);
            this.volumesLabel.set_text(`Volumes: ${volumes.length}`);
        } else {
            this.volumesLabel.set_text('Volumes: 0');
        }
    }
}