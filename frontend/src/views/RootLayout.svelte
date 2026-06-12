<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import ProjectSidebar from "$lib/components/project-sidebar/index.js";
    import SiteHeader from "$lib/components/site-header/index.js";
    import { ModeWatcher } from "mode-watcher";
</script>

<ModeWatcher />

<div class="[--header-height:calc(--spacing(10))]">
    <Sidebar.Provider class="flex flex-col">
        <SiteHeader />

        <div class="flex flex-1">
            <ProjectSidebar />
            <Sidebar.Inset>
                <main>
                    <h1>Root Layout</h1>
                    <slot />
                </main>
            </Sidebar.Inset>
        </div>
    </Sidebar.Provider>
</div>
