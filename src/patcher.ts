import { create } from "jsondiffpatch";
import { Player } from "./main/GameReader";

export default create({
	objectHash: (obj: Player) => obj.ptr,
	arrays: {
		detectMove:false
	}
});