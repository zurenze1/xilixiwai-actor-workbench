import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {WorkDataScene} from './WorkDataScene';
import {blankData} from './work-data-v3';
registerRoot(()=> <>
 <Composition id="WorkHorizontal" component={WorkDataScene} width={1920} height={1080} fps={30} durationInFrames={240} defaultProps={{data:blankData('salary')}} calculateMetadata={({props})=>({durationInFrames:props.data.duration*30})}/>
 <Composition id="WorkVertical" component={WorkDataScene} width={1080} height={1920} fps={30} durationInFrames={240} defaultProps={{data:blankData('salary')}} calculateMetadata={({props})=>({durationInFrames:props.data.duration*30})}/>
</>);
