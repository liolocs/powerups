<script lang="ts">
    import { PanelLeftIcon, SettingsIcon } from "@lucide/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { useSidebar } from "$lib/components/ui/sidebar/context.svelte.js";

    const sidebar = useSidebar();
</script>

<header
    class="sticky top-0 z-50 flex w-full items-center border-b bg-background px-2 pl-16"
>
    <div class="flex h-(--header-height) w-full items-center px-2">
        <Button
            class="size-7"
            variant="ghost"
            size="icon"
            onclick={sidebar.toggle}
        >
            <PanelLeftIcon />
        </Button>
         <Button
            class="size-7"
            variant="ghost"
            size="icon"
        >
            <SettingsIcon />
        </Button>
    </div>
</header>
