import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('desktop_helper',pathlib.Path(__file__).resolve().parents[2]/'tools'/'desktop_helper.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
class Device:
    width=1920;height=1080
    def __init__(self):self.inputs=[];self.releases=0
    def send(self,event):self.inputs.append(event)
    def release(self):self.releases+=1
class DesktopHelperTests(unittest.TestCase):
    def setUp(self):self.device=Device();self.state=helper.BridgeState(self.device,lambda peer:peer=='Approved guest','http://127.0.0.1:4000')
    def pair(self,peer='Approved guest'):return self.state.pair({'token':self.state.token,'call_id':'12345678-1234-1234-1234-123456789012','peer_name':peer})
    def test_requires_local_approval_and_secret(self):
        with self.assertRaises(ValueError):self.pair('Unknown guest')
        with self.assertRaises(PermissionError):self.state.request('input',{'event':{'type':'move','x':0.1,'y':0.2}},'invalid')
        self.assertEqual(self.device.inputs,[])
        response=self.pair();self.state.request('input',{'event':{'type':'move','x':0.2,'y':0.3}},response['key'])
        self.assertEqual(len(self.device.inputs),1)
    def test_lease_expires_and_releases_held_input(self):
        key=self.pair()['key'];self.state.last_seen-=16
        with self.assertRaises(PermissionError):self.state.request('input',{'event':{'type':'key','key':'a','down':True}},key)
        self.assertEqual(self.device.inputs,[]);self.assertGreater(self.device.releases,0)
    def test_revoke_prevents_input_and_pair_token_is_rotated(self):
        old=self.state.token;key=self.pair()['key'];self.assertNotEqual(old,self.state.token)
        self.state.request('revoke',{},key)
        with self.assertRaises(PermissionError):self.state.request('heartbeat',{},key)
    def test_rejects_invalid_coordinates_commands_and_keys(self):
        key=self.pair()['key']
        for event in [{'type':'move','x':float('nan'),'y':0.2},{'type':'move','x':2,'y':0},{'type':'exec','command':'ignored'},{'type':'key','key':'Meta','down':True}]:
            with self.assertRaises(ValueError):self.state.request('input',{'event':event},key)
        self.assertEqual(self.device.inputs,[])
