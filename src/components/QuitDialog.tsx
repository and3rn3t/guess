// Quit confirmation dialog — extracted from App.tsx (RF.4).
// Two-action confirm: "Give Up" (records loss) vs "Quit Without Saving" (discard).

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSurrender: () => void;
  onQuit: () => void;
}

export function QuitDialog({
  open,
  onOpenChange,
  onSurrender,
  onQuit,
}: Readonly<QuitDialogProps>) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this game?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>Give Up</strong> records your session and asks what you were thinking of — same as a regular loss.
            <br />
            <strong>Quit</strong> abandons the game without saving anything.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="sm:mr-auto">
            Keep Playing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onSurrender}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0"
          >
            Give Up
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onQuit}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
          >
            Quit Without Saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
