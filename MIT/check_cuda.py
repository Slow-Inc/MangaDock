import torch
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device: {torch.cuda.get_device_name(0)}")
    print(f"CUDA Version: {torch.version.cuda}")
    print(f"Current Device index: {torch.cuda.current_device()}")
    # Test a simple tensor on GPU
    try:
        x = torch.randn(1).cuda()
        print("Successfully moved tensor to GPU")
    except Exception as e:
        print(f"Failed to move tensor to GPU: {e}")
else:
    print("CUDA not available")
