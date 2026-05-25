import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Themed text field consistent with the web frontend's input style.
class ActivosTextField extends StatelessWidget {
  const ActivosTextField({
    super.key,
    required this.controller,
    required this.label,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.onSubmitted,
    this.maxLines = 1,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onSubmitted;
  final int maxLines;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      validator: validator,
      onFieldSubmitted: onSubmitted,
      maxLines: maxLines,
      enabled: enabled,
      style: const TextStyle(color: AppColors.text, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, size: 18, color: AppColors.textMuted)
            : null,
        suffixIcon: suffixIcon,
      ),
    );
  }
}
