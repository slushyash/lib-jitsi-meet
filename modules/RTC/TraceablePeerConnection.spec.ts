import { MediaType } from '../../service/RTC/MediaType';

import TraceablePeerConnection from './TraceablePeerConnection';

describe('TraceablePeerConnection local source mapping', () => {
    const processAndExtractSourceInfo
        = (TraceablePeerConnection.prototype as any)._processAndExtractSourceInfo;
    const processLocalSdpForTransceiverInfo
        = (TraceablePeerConnection.prototype as any).processLocalSdpForTransceiverInfo;

    const createLocalDescriptionSdp = () => [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0 1 2',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111 126',
        'c=IN IP4 0.0.0.0',
        'a=rtpmap:111 opus/48000/2',
        'a=rtpmap:126 telephone-event/8000',
        'a=mid:0',
        'a=sendrecv',
        'a=ssrc:1001 cname:audio0',
        'a=ssrc:1001 msid:- audio-track-0',
        'm=video 9 UDP/TLS/RTP/SAVPF 101 97',
        'c=IN IP4 0.0.0.0',
        'a=rtpmap:101 VP9/90000',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=101',
        'a=mid:1',
        'a=sendrecv',
        'a=ssrc:2001 cname:video0',
        'a=ssrc:2001 msid:- video-track-0',
        'a=ssrc:2002 cname:video0',
        'a=ssrc:2002 msid:- video-track-0',
        'a=ssrc-group:FID 2001 2002',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'c=IN IP4 0.0.0.0',
        'a=mid:2',
        'a=sendrecv',
        'a=sctp-port:5000',
        ''
    ].join('\r\n');

    const createLocalTrack = (rtcId: number, mediaType: MediaType, sourceName: string) => ({
        getSourceName: () => sourceName,
        getType: () => mediaType,
        rtcId,
        setSsrc: jasmine.createSpy('setSsrc')
    });

    it('skips SSRC extraction for local tracks without matching send-capable m-lines', () => {
        const audioTrack0 = createLocalTrack(1, MediaType.AUDIO, 'endpoint-a0');
        const audioTrack1 = createLocalTrack(2, MediaType.AUDIO, 'endpoint-a1');
        const videoTrack0 = createLocalTrack(3, MediaType.VIDEO, 'endpoint-v0');
        const fakeTPC = {
            _extractPrimarySSRC: (TraceablePeerConnection.prototype as any)._extractPrimarySSRC,
            _localSsrcMap: null,
            isSpatialScalabilityOn: () => false,
            localSSRCs: new Map(),
            localTracks: new Map([
                [ audioTrack0.rtcId, audioTrack0 ],
                [ audioTrack1.rtcId, audioTrack1 ],
                [ videoTrack0.rtcId, videoTrack0 ]
            ]),
            rtc: {
                getLocalEndpointId: () => 'endpoint'
            },
            toString: () => 'TPC[test]'
        };

        expect(() => processAndExtractSourceInfo.call(fakeTPC, createLocalDescriptionSdp())).not.toThrow();
        expect(fakeTPC.localSSRCs.get(audioTrack0.rtcId)?.ssrcs).toEqual([ 1001 ]);
        expect(fakeTPC.localSSRCs.get(videoTrack0.rtcId)?.ssrcs).toEqual([ 2001, 2002 ]);
        expect(fakeTPC.localSSRCs.has(audioTrack1.rtcId)).toBeFalse();
        expect(audioTrack1.setSsrc).not.toHaveBeenCalled();
    });

    it('skips transceiver mid caching for local tracks without matching m-lines', () => {
        const audioTrack0 = createLocalTrack(1, MediaType.AUDIO, 'endpoint-a0');
        const audioTrack1 = createLocalTrack(2, MediaType.AUDIO, 'endpoint-a1');
        const videoTrack0 = createLocalTrack(3, MediaType.VIDEO, 'endpoint-v0');
        const localTrackTransceiverMids = new Map();
        const fakeTPC = {
            localDescription: {
                sdp: createLocalDescriptionSdp()
            },
            localTrackTransceiverMids,
            toString: () => 'TPC[test]'
        };

        expect(() => processLocalSdpForTransceiverInfo.call(
            fakeTPC,
            [ audioTrack0, audioTrack1, videoTrack0 ])).not.toThrow();
        expect(localTrackTransceiverMids.get(audioTrack0.rtcId)).toBe('0');
        expect(localTrackTransceiverMids.get(videoTrack0.rtcId)).toBe('1');
        expect(localTrackTransceiverMids.has(audioTrack1.rtcId)).toBeFalse();
    });

    it('uses source-name indexes when caching mids for a subset of local tracks', () => {
        const audioTrack1 = createLocalTrack(2, MediaType.AUDIO, 'endpoint-a1');
        const localTrackTransceiverMids = new Map();
        const fakeTPC = {
            localDescription: {
                sdp: createLocalDescriptionSdp()
            },
            localTrackTransceiverMids,
            toString: () => 'TPC[test]'
        };

        processLocalSdpForTransceiverInfo.call(fakeTPC, [ audioTrack1 ]);

        expect(localTrackTransceiverMids.has(audioTrack1.rtcId)).toBeFalse();
    });
});
