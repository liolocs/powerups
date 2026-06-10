<script lang="ts">
	import './app.css';
	import { Events } from "@wailsio/runtime";
	import { GreetService } from "../bindings/changeme";
  import Button from "$lib/components/ui/button/button.svelte";
  import RootLayout from './views/RootLayout.svelte';

	let name: string = $state('');
	let result: string = $state('Please enter your name below 👇');
	let time: string = $state('Listening for Time event...');

	const doGreet = (): void => {
		let localName = name;

		if (!localName) {
			localName = 'anonymous';
		}

		GreetService.Greet(localName).then((resultValue: string) => {
			result = resultValue;
		}).catch((err: any) => {
			console.log(err);
		});
	};

	Events.On('time', (timeValue: any) => {
		time = timeValue.data;
	});
</script>

<RootLayout>
<div class="container">
	<div>
		<span data-wml-openURL="https://wails.io"><img src="/wails.png" class="logo" alt="Wails logo" /></span>

		<span data-wml-openURL="https://svelte.dev">
			<img
				src="/svelte.svg"
				class="logo svelte"
				alt="Svelte logo"
			/>
		</span>
	</div>

	<h1>Wails + Svelte</h1>
	<div aria-label="result" class="result">{result}</div>

	<div class="card">
		<div class="input-box">
			<input
				aria-label="input"
				class="input"
				bind:value={name}
				type="text"
				autocomplete="off"
			/>

			<Button
				aria-label="greet-btn"
				onclick={doGreet}
        variant="default"
			>
				Greet
			</Button>
		</div>
	</div>

	<div class="footer">
		<div><p>Click on the Wails logo to learn more</p></div>
		<div><p>{time}</p></div>
	</div>
</div>
</RootLayout>

<style></style>
