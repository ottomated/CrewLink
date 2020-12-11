import { create } from 'jsondiffpatch';
import { Player } from './common/AmongUsState';

export default create({
	objectHash: (obj: Player) => obj.ptr,
	arrays: {
		detectMove:false
	}
});