<script lang="ts">
	import Element from '#lib/knowledgepanels/Element.svelte';
	import type { KnowledgeMapElement } from '#lib/api.js';
	const element: KnowledgeMapElement = {
		element_type: 'map',
		map_element: { pointers: [{ geo: { lat: 47.8825837, lng: 2.1306532 } }] }
	};
</script>

<h1>Knowledge panel manufacturing place — real API payload 3248340054063</h1>
<Element {element} panels={{}} />
